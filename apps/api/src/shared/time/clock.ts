import { Injectable } from '@nestjs/common';

@Injectable()
export class Clock {
  nowMs(): number {
    return Date.now();
  }

  now(): Date {
    return new Date(this.nowMs());
  }
}
