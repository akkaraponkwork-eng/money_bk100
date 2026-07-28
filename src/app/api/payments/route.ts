import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSheetAuth } from '@/lib/google-sheets';
import type { PaymentRecord } from '@/types';

export const dynamic = 'force-dynamic';

function rowToRecord(row: string[]): PaymentRecord {
  return {
    id: row[0] || '',
    month: Number(row[1]) || 0,
    year: Number(row[2]) || 0,
    firstName: row[3] || '',
    lastName: row[4] || '',
    amount: Number(row[5]) || 0,
    isPaid: String(row[6]).toLowerCase() === 'true',
    paidAt: row[7] || undefined,
    paymentType: (row[8] || 'salary') as 'salary' | 'allowance',
    isMuleAccount: String(row[9]).toLowerCase() === 'true',
    payableAmount: row[10] !== undefined && row[10] !== '' ? Number(row[10]) : undefined,
    rolloverAmount: Number(row[11]) || 0,
    selfWithdrawnAmount: Number(row[12]) || 0,
    previousRollover: Number(row[13]) || 0,
    personId: row[14] || '',
    otherDeductions: Number(row[15]) || 0,
  };
}

function recordToRow(r: PaymentRecord): string[] {
  return [
    r.id,
    String(r.month),
    String(r.year),
    r.firstName,
    r.lastName,
    String(r.amount),
    String(r.isPaid),
    r.paidAt || '',
    r.paymentType || 'salary',
    String(r.isMuleAccount || false),
    String(r.payableAmount !== undefined ? r.payableAmount : (r.amount || 0)),
    String(r.rolloverAmount || 0),
    String(r.selfWithdrawnAmount || 0),
    String(r.previousRollover || 0),
    r.personId || '',
    String(r.otherDeductions || 0)
  ];
}

// GET: Fetch all payment records
export async function GET() {
  try {
    const { auth, sheetId } = getSheetAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Payments!A2:P',
    });
    
    const rows = (res.data.values || []).filter(r => r[0]);
    return NextResponse.json({ records: rows.map(rowToRecord) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Upload multiple payment records
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { records }: { records: PaymentRecord[] } = body;
    
    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 });
    }

    const { auth, sheetId } = getSheetAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const rows = records.map(recordToRow);
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Payments!A:P',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update isPaid and paidAt for a specific record
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { recordId, isPaid, paidAt }: { recordId: string, isPaid: boolean, paidAt?: string } = body;

    const { auth, sheetId } = getSheetAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Find row index
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Payments!A:A',
    });
    
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === recordId);
    
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const actualRowNumber = rowIndex + 1;

    // Update G (isPaid) and H (paidAt)
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Payments!G${actualRowNumber}:H${actualRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[String(isPaid), paidAt || '']] },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a specific payment record or a batch of records
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    const batchPrefix = searchParams.get('batchPrefix');

    if (!recordId && !batchPrefix) {
      return NextResponse.json({ error: 'Missing recordId or batchPrefix' }, { status: 400 });
    }

    const { auth, sheetId } = getSheetAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Payments!A:P',
    });

    const rows = res.data.values || [];
    const rowsToDelete: number[] = [];
    const rolloverRestorations: { personId: string; previousRollover: number }[] = [];

    if (recordId) {
      const rowIndex = rows.findIndex((row) => row[0] === recordId);
      if (rowIndex !== -1) {
        rowsToDelete.push(rowIndex);
        if (rows[rowIndex][14] && rows[rowIndex][13] !== undefined) {
          rolloverRestorations.push({
            personId: rows[rowIndex][14],
            previousRollover: Number(rows[rowIndex][13]) || 0
          });
        }
      }
    } else if (batchPrefix) {
      rows.forEach((row, index) => {
        if (row[0] && row[0].startsWith(batchPrefix)) {
          rowsToDelete.push(index);
          if (row[14] && row[13] !== undefined) {
            rolloverRestorations.push({
              personId: row[14],
              previousRollover: Number(row[13]) || 0
            });
          }
        }
      });
    }

    if (rowsToDelete.length === 0) {
      return NextResponse.json({ error: 'Records not found' }, { status: 404 });
    }

    const sheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });
    
    const paymentsSheet = sheetInfo.data.sheets?.find(
      s => s.properties?.title === 'Payments'
    );

    if (!paymentsSheet?.properties?.sheetId && paymentsSheet?.properties?.sheetId !== 0) {
      return NextResponse.json({ error: 'Payments sheet not found' }, { status: 500 });
    }

    // Sort descending so deleting higher indices doesn't affect lower indices
    rowsToDelete.sort((a, b) => b - a);

    const requests = rowsToDelete.map(rowIndex => ({
      deleteDimension: {
        range: {
          sheetId: paymentsSheet.properties.sheetId,
          dimension: 'ROWS',
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests },
    });

    // Restore previous rollover to Personnel sheet
    if (rolloverRestorations.length > 0) {
      const personnelRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Personnel!A:A',
      });
      const personnelRows = personnelRes.data.values || [];
      const personnelUpdates = [];

      for (const restoration of rolloverRestorations) {
        const pIndex = personnelRows.findIndex(row => row[0] === restoration.personId);
        if (pIndex !== -1) {
          personnelUpdates.push({
            range: `Personnel!L${pIndex + 1}`,
            values: [[String(restoration.previousRollover)]]
          });
        }
      }

      if (personnelUpdates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: personnelUpdates
          }
        });
      }
    }

    return NextResponse.json({ success: true, deletedCount: rowsToDelete.length, restoredCount: rolloverRestorations.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
