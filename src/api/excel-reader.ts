import * as XLSX from 'xlsx';
import { FilePayload } from './types';

class ExcelReader {
    private options: XLSX.ParsingOptions = { type: 'array', cellStyles: true, sheetStubs: true, FS: '||||' }

    read(data: Uint8Array<ArrayBuffer>): FilePayload {
        const {Sheets, SheetNames} = XLSX.read(data, this.options);
        return {Sheets, SheetNames} as FilePayload
    }
}


export const excelReader = new ExcelReader()