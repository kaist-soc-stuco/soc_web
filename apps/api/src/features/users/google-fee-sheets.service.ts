import { GoneException, Injectable } from "@nestjs/common";

@Injectable()
export class GoogleFeeSheetsService {
  async getReference(..._args: unknown[]): Promise<never> {
    throw new GoneException("google_sheets_retired");
  }
  async connect(..._args: unknown[]): Promise<never> {
    throw new GoneException("google_sheets_retired");
  }
  async sync(..._args: unknown[]): Promise<never> {
    throw new GoneException("google_sheets_retired");
  }
}
