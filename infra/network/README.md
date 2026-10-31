# KAIST SSO 출발 경로 고정

`ESA007 / invalid_access_perm_ip`는 KAIST가 인증 코드 교환 요청의 출발지 IP를 거부한 경우다. KAIST SSO 서버의 IPv4 목적지에 `/32` 경로를 추가해, 허용된 출발지 IP를 사용하는 인터페이스로 보낸다.

이 문서와 `.conf.example`의 IP는 설명용 TEST-NET 주소다. 실제 운영 IP·게이트웨이·네트워크 구성은 공개 문서에 기록하지 않고 서버의 `/etc/soc-web/sso-egress.conf`에서 관리한다. 체크아웃의 `infra/network/sso-egress.conf`도 Git에서 제외한다.

기본 경로, Docker 네트워크, 앱의 SSO URL·인증서·키는 변경하지 않는다. 일반적인 Docker bridge의 MASQUERADE 규칙은 컨테이너 요청의 주소를 호스트 측 주소로 변환한다. 추가적인 상위 NAT가 있다면 KAIST가 보는 최종 주소는 그 NAT 설정도 확인해야 한다.

이것은 **목적지 IP 기준** 설정이다. 같은 SSO 서버 IP로 가는 다른 프로세스의 통신도 같은 경로를 사용한다. API 프로세스만 분리하거나 같은 IP의 다른 서비스와 구분하는 프록시 설정은 아니다. 현재 구성은 IPv4용이다. IPv6로 SSO에 연결하는 환경에는 별도 IPv6 경로가 필요하다.

`eth0`의 출발지 IP가 KAIST 허용 목록에 등록돼 있다는 것은 인프라/SSO 담당자에게 확인해야 한다. 이 설정은 네트워크 경로를 선택하며 KAIST의 허용 목록을 변경하지 않는다.

## 설치 및 적용

**컨테이너 안이 아닌 Linux Docker 호스트**에서, 체크아웃 루트에서 실행한다. Bash 4+, `iproute2`, `getent`, `flock`이 필요하다. 예시 config는 실제 서버에서 사용할 수 없으므로 아래 설치 과정에서 반드시 수정한다. 기존 config가 있으면 예시 파일 복사는 건너뛴다.

```bash
sudo install -d -m 0755 /etc/soc-web
sudo install -m 0644 infra/network/sso-egress.conf.example /etc/soc-web/sso-egress.conf
# 실제 SSO 호스트, 인터페이스, 게이트웨이, 출발지 IP로 수정한다.
sudoedit /etc/soc-web/sso-egress.conf
sudo install -m 0755 infra/network/sso-egress-route.sh /usr/local/sbin/soc-web-sso-egress

# 읽기 전용: 인터페이스·출발지·게이트웨이·기존 /32 경로 확인
sudo /usr/local/sbin/soc-web-sso-egress check

# 목적지 경로 추가. 기본 경로와 다른 수동 /32 경로는 덮어쓰지 않는다.
sudo /usr/local/sbin/soc-web-sso-egress apply
```

추가되는 경로 형식은 아래와 같다(설명용 주소). DNS 응답이 여러 주소면 각 주소에 하나씩 추가한다.

```text
198.51.100.20 via 192.0.2.1 dev eth0 proto 242 src 192.0.2.10 metric 42761
```

경로 추가만으로 적용된다. Docker 재시작·앱 env 수정은 필요하지 않다. 기존에 열린 SSO TCP 연결은 이전 출발지 주소를 유지할 수 있다. 경로가 적용됐는데도 오류가 남으면 API를 한 번 재시작해 연결을 새로 생성하고 새 로그인으로 확인한다.

현재 사용하는 Compose 명령으로 실행한다. 기본 compose 사용 시:

```bash
docker compose restart api
```

## 재부팅과 DNS 변경에 대응

```bash
sudo install -m 0644 infra/network/soc-web-sso-egress.service /etc/systemd/system/
sudo install -m 0644 infra/network/soc-web-sso-egress.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now soc-web-sso-egress.timer
sudo systemctl start soc-web-sso-egress.service
```

타이머가 매분 DNS 주소를 재확인하고 새 목적지를 추가한 후 오래된 목적지를 제거한다. DNS 조회 실패나 기존 수동 경로와 충돌 시 기존 경로를 유지하고 오류를 기록한다. DNS 갱신과 다음 타이머 실행 사이에는 새 IP가 기존 기본 경로를 사용할 수 있다. SSO 환경을 운영 주소 `sso.kaist.ac.kr`로 변경할 때는 `/etc/soc-web/sso-egress.conf`의 `SSO_EGRESS_HOST`도 함께 바꾸고 서비스를 실행한다.

프로토콜 `242`와 metric `42761`의 조합을 이 도구 전용으로 예약한다. 해제·DNS 갱신은 이 조합의 `/32` 경로만 삭제한다. 기존에 같은 조합을 쓰는 도구가 있다면 먼저 담당자와 조정한다.

## 검증

아래 `SSO_IP`와 `eth0`은 실제 DNS 결과와 설정된 인터페이스로 바꾼다.

```bash
SSO_IP="$(getent ahostsv4 ssodev.kaist.ac.kr | awk 'NR==1 {print $1}')"
ip -4 route get "$SSO_IP"
sudo systemctl status soc-web-sso-egress.timer --no-pager
sudo journalctl -u soc-web-sso-egress.service -n 30 --no-pager

# Docker가 전달한 요청도 실제로 eth0에 나오는지 확인한다.
# 터미널을 띄워 둔 채 브라우저에서 새 로그인한다. Ctrl+C로 종료한다.
sudo tcpdump -ni eth0 "host $SSO_IP and tcp port 443"
```

`ip route get`은 config에 지정한 게이트웨이·인터페이스·출발지 IP를 보여야 한다. 패킷 캡처는 `-A`/`-X` 없이 연결 헤더만 확인한다. 로그인 후 API 로그의 `invalid_access_perm_ip`가 없어지고 실제로 로그인되는 것까지 확인한다. 기본 compose 사용 시:

```bash
docker compose logs --since=5m --no-color api | grep 'SSO callback failed at exchange'
```

경로는 맞는데 `invalid_access_perm_ip`가 계속되면 KAIST 담당자가 실제 수신한 출발지 IP와 허용 목록을 비교한다. `client_secret`, 인증 `code`/`state`는 공유하지 않는다. 호스트에 정책 라우팅(`ip rule`)이나 별도 SNAT 규칙이 있다면 Docker에서 전달된 패킷도 `eth0`을 쓰는지 함께 점검한다. 이 도구는 그 규칙을 임의로 변경하지 않는다.

## 해제

```bash
sudo systemctl disable --now soc-web-sso-egress.timer
sudo systemctl stop soc-web-sso-egress.service
sudo /usr/local/sbin/soc-web-sso-egress remove
ip -4 route get "$SSO_IP"
```

예약된 프로토콜/metric 조합의 경로만 제거한다. DNS 조회나 인터페이스가 실패한 상황에서도 `remove`는 사용할 수 있다.

참고: [iproute2 공식 매뉴얼](https://man7.org/linux/man-pages/man8/ip-route.8.html), [Docker 포트·출발지 주소 변환](https://docs.docker.com/engine/network/port-publishing/).

## 도구 테스트

실제 경로를 변경하지 않고 가짜 `ip`/`getent`로 Bash 스크립트의 조회·중복 실행·수동 경로 충돌·부분 실패 롤백·DNS 장애·DNS 갱신·해제를 검사한다.

```bash
python3 infra/network/test_sso_egress.py
bash -n infra/network/sso-egress-route.sh
```
