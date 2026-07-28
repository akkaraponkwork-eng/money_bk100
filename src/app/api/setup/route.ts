import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSheetAuth } from '@/lib/google-sheets';

export async function GET() {
  try {
    const { auth, sheetId } = getSheetAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Get existing sheets
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const existingSheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

    // 2. Add 'Payments' sheet if not exists
    if (!existingSheetNames.includes('Payments')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            { addSheet: { properties: { title: 'Payments' } } }
          ]
        }
      });
      
      // 3. Write headers
      const headers = ['RecordID', 'Month', 'Year', 'Name', 'Surname', 'Amount', 'IsPaid', 'PaidAt', 'PaymentType'];
      const endCol = String.fromCharCode(65 + headers.length - 1); // I
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Payments!A1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers]
        }
      });
      
      return NextResponse.json({ success: true, message: 'Created Payments sheet' });
    }

    return NextResponse.json({ success: true, message: 'Payments sheet already exists' });
  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
