#!/usr/bin/env bash
# Host-side IPv4 routes for KAIST SSO; never run inside the API container.
set -euo pipefail

action="${1:-check}"
case "$action" in check|apply|remove) ;; *) echo 'Usage: sso-egress-route.sh [check|apply|remove]' >&2; exit 2 ;; esac

config_file="${SSO_EGRESS_CONFIG:-/etc/soc-web/sso-egress.conf}"
if [[ -f "$config_file" ]]; then
  # Root-owned, non-secret shell assignments, also accepted by systemd.
  source "$config_file"
fi
host="${SSO_EGRESS_HOST:-ssodev.kaist.ac.kr}"
interface="${SSO_EGRESS_INTERFACE:-eth0}"
gateway="${SSO_EGRESS_GATEWAY:-}"
source_ip="${SSO_EGRESS_SOURCE_IP:-}"
# Reserve this protocol/metric pair exclusively for this script on this host.
protocol=242
metric=42761

fail() { echo "SSO egress: $*" >&2; exit 1; }
for tool in ip getent awk sort; do command -v "$tool" >/dev/null || fail "missing command: $tool"; done

owned_routes() {
  ip -N -4 route show table main proto "$protocol" | awk -v metric="$metric" '
    { for (i=1; i<NF; i++) if ($i=="metric" && $(i+1)==metric) {
        if ($1 !~ /\//) $1=$1 "/32"; print $0
    } }
  '
}
delete_owned() {
  # Match every ownership selector; never flush a table or delete a default route.
  ip -4 route del "$1" table main proto "$protocol" metric "$metric"
}

if [[ "$action" != check ]]; then
  [[ "$(id -u)" == 0 ]] || fail 'apply/remove must run as root on the Docker host'
  command -v flock >/dev/null || fail 'missing command: flock'
  exec 9>"${SSO_EGRESS_LOCK_FILE:-/run/lock/soc-web-sso-egress.lock}"
  flock -n 9 || fail 'another SSO routing operation is running'
fi

if [[ "$action" == remove ]]; then
  routes_to_remove="$(owned_routes)"
  while read -r prefix rest; do
    [[ -n "$prefix" ]] || continue
    [[ "$prefix" == */32 ]] || fail "unexpected owned route: $prefix; inspect manually"
    delete_owned "$prefix"
    echo "Removed $prefix"
  done <<< "$routes_to_remove"
  exit 0
fi

[[ -n "$gateway" && -n "$source_ip" ]] || fail "set SSO_EGRESS_GATEWAY and SSO_EGRESS_SOURCE_IP in $config_file"
ip link show dev "$interface" >/dev/null || fail "interface not found: $interface"
addresses="$(ip -4 -o addr show dev "$interface" scope global)"
awk -v expected="$source_ip" '{split($4,a,"/"); if(a[1]==expected) found=1} END {exit !found}' <<< "$addresses" \
  || fail "$source_ip is not assigned to $interface"
# Check that the supplied gateway really is directly reachable on this NIC.
gateway_route="$(ip -4 route get "$gateway" oif "$interface")"
[[ " $gateway_route " == *" dev $interface "* && " $gateway_route " != *' via '* ]] \
  || fail "$gateway is not directly reachable on $interface"

resolved="$(getent ahostsv4 "$host")" || fail "DNS lookup failed for $host; existing routes were kept"
mapfile -t destinations < <(awk '{print $1 "/32"}' <<< "$resolved" | sort -u)
[[ ${#destinations[@]} -gt 0 ]] || fail 'DNS returned no IPv4 addresses'
for prefix in "${destinations[@]}"; do
  [[ "$prefix" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/32$ ]] || fail "unexpected DNS address: $prefix"
done

echo "Target: $host via $gateway dev $interface src $source_ip"
echo 'Current default routes (will not be changed):'
ip -4 route show default

# Preflight ALL destinations before adding any route. Preserve existing manual
# /32 routes rather than replacing them or silently losing to their metrics.
declare -a pending=()
for prefix in "${destinations[@]}"; do
  existing="$(ip -N -4 route show table main exact "$prefix")"
  if [[ -n "$existing" ]]; then
    [[ "$existing" != *$'\n'* ]] || fail "multiple existing routes for $prefix; inspect manually"
    for required in "via $gateway" "dev $interface" "proto $protocol" "src $source_ip" "metric $metric"; do
      [[ " $existing " == *" $required "* ]] || fail "conflicting existing route: $existing; no routes changed"
    done
    echo "Already configured: $existing"
  else
    pending+=("$prefix")
    echo "Planned: ip -4 route add $prefix via $gateway dev $interface src $source_ip proto $protocol metric $metric"
  fi
  [[ "$action" != check ]] || ip -4 route get "${prefix%/32}"
done
[[ "$action" != check ]] || exit 0

declare -a added=()
for prefix in "${pending[@]}"; do
  if ! ip -4 route add "$prefix" via "$gateway" dev "$interface" src "$source_ip" proto "$protocol" metric "$metric"; then
    for rollback in "${added[@]}"; do delete_owned "$rollback" || true; done
    fail 'could not add route; additions from this run were rolled back'
  fi
  added+=("$prefix")
done

# Remove stale DNS addresses only after the new set has been installed.
routes_to_check="$(owned_routes)"
while read -r prefix rest; do
  [[ -n "$prefix" ]] || continue
  [[ "$prefix" == */32 ]] || fail "unexpected owned route: $prefix; inspect manually"
  keep=false
  for wanted in "${destinations[@]}"; do [[ "$prefix" != "$wanted" ]] || keep=true; done
  if [[ "$keep" == false ]]; then delete_owned "$prefix"; echo "Removed stale DNS route: $prefix"; fi
done <<< "$routes_to_check"
for prefix in "${destinations[@]}"; do ip -4 route get "${prefix%/32}"; done
