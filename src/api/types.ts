import { WorkSheet } from 'xlsx';

export type FilePayload = {
    Sheets: { [sheet: string]: WorkSheet };
    SheetNames: string[];
}