import { GoneException, Injectable } from "@nestjs/common";

@Injectable()
export class GoogleSurveySheetsService {
  async connect(..._args: unknown[]): Promise<never> {
    throw new GoneException("google_sheets_retired");
  }
  async refresh(..._args: unknown[]): Promise<never> {
    throw new GoneException("google_sheets_retired");
  }
  async enqueueRefresh(_surveyId: string): Promise<void> {}
}
