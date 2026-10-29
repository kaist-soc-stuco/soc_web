import { GoneException, Injectable } from "@nestjs/common";

@Injectable()
export class GoogleContactSheetsService {
  async getReference(..._args: unknown[]): Promise<never> {
    throw new GoneException("google_sheets_retired");
  }
  async sync(..._args: unknown[]): Promise<never> {
    throw new GoneException("google_sheets_retired");
  }
  async enqueueSync(): Promise<void> {}
}
