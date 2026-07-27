import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../../infrastructure/redis/redis.provider";

const COMPARE_DELETE_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return {0} end
local record = cjson.decode(raw)
if record.bindingHash ~= ARGV[1] then return {0} end
redis.call("DEL", KEYS[1])
return {1, raw}
`;

@Injectable()
export class AuthStateRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async compareAndDelete(key: string, bindingHash: string): Promise<string | null> {
    const result = (await this.redis.eval(COMPARE_DELETE_LUA, 1, key, bindingHash)) as unknown;
    if (!Array.isArray(result) || Number(result[0]) !== 1 || typeof result[1] !== "string") return null;
    return result[1];
  }
}
