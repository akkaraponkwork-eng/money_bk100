import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSheetAuth } from '@/lib/google-sheets';
import type { Personnel } from '@/types';

export const dynamic = 'force-dynamic';

function rowToPersonnel(row: string[]): Personnel {
  return {
    id: row[0] || '',
    rank: row[1] || '',
    firstName: row[2] || '',
    lastName: row[3] || '',
    isMuleAccount: String(row[10]).toLowerCase() === 'true',
    rolloverBalance: Number(row[11]) || 0,
  };
}

// GET /api/personnel
export async function GET() {
  try {
    const { auth, sheetId } = getSheetAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Personnel sheet from dutycheck project (fetching up to L for rolloverBalance)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Personnel!A2:L', 
    });
    
    const rows = (res.data.values || []).filter(r => r[0]);
    return NextResponse.json({ personnel: rows.map(rowToPersonnel) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/personnel
// Used to update isMuleAccount in Column K
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { personId, isMuleAccount }: { personId: string, isMuleAccount: boolean } = body;

    if (!personId) {
      return NextResponse.json({ error: 'Missing personId' }, { status: 400 });
    }

    const { auth, sheetId } = getSheetAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Find row index by personId
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Personnel!A:A',
    });
    
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === personId);
    
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Personnel not found' }, { status: 404 });
    }

    const actualRowNumber = rowIndex + 1;

    // Update Column K (isMuleAccount)
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Personnel!K${actualRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[String(isMuleAccount)]] },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/personnel
// Used for bulk updating rolloverBalance in Column L
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { updates }: { updates: { personId: string, rolloverBalance: number }[] } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Invalid updates array' }, { status: 400 });
    }

    const { auth, sheetId } = getSheetAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Find row indexes
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Personnel!A:A',
    });
    
    const rows = res.data.values || [];
    const data = [];

    for (const update of updates) {
      const rowIndex = rows.findIndex(row => row[0] === update.personId);
      if (rowIndex !== -1) {
        data.push({
          range: `Personnel!L${rowIndex + 1}`,
          values: [[String(update.rolloverBalance)]]
        });
      }
    }

    if (data.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: data
        }
      });
    }

    return NextResponse.json({ success: true, updated: data.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
