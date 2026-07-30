import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, username, password } = body;

    if (action === 'logout') {
      const response = NextResponse.json({ success: true });
      response.cookies.delete('bk100_auth');
      return response;
    }

    if (action === 'login') {
      const validUser = process.env.ADMIN_USERNAME || 'admin';
      const validPass = process.env.ADMIN_PASSWORD || 'bk100admin';
      
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown IP';
      const userAgent = request.headers.get('user-agent') || 'Unknown Agent';
      const timestamp = new Date().toISOString();

      // Helper function to log to sheets
      const logToSheet = async (status: string) => {
        try {
          const { getSheetAuth } = await import('@/lib/google-sheets');
          const { google } = await import('googleapis');
          const { auth, sheetId } = getSheetAuth();
          const sheets = google.sheets({ version: 'v4', auth });
          
          // Check if AccessLogs sheet exists
          const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
          const logSheet = sheetInfo.data.sheets?.find(s => s.properties?.title === 'AccessLogs');
          
          if (!logSheet) {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId: sheetId,
              requestBody: {
                requests: [{ addSheet: { properties: { title: 'AccessLogs' } } }]
              }
            });
            // Add headers
            await sheets.spreadsheets.values.append({
              spreadsheetId: sheetId,
              range: 'AccessLogs!A1:E1',
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [['Timestamp', 'Username', 'Status', 'IP Address', 'User Agent']] }
            });
          }

          // Append log
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'AccessLogs!A:E',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[timestamp, username, status, ip, userAgent]] }
          });
        } catch (logErr) {
          console.error('Failed to log access:', logErr);
        }
      };

      if (username === validUser && password === validPass) {
        // Log success (don't await so it doesn't block response too much)
        logToSheet('SUCCESS');
        
        const response = NextResponse.json({ success: true });
        response.cookies.set('bk100_auth', 'true', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
        return response;
      }
      
      // Log failure
      logToSheet('FAILED');
      
      return NextResponse.json({ error: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
