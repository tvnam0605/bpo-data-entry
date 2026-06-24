import { google } from 'googleapis'

const getAuthClient = () =>
  new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

export const getSheetsClient = async () => {
  const auth = getAuthClient()
  return google.sheets({ version: 'v4', auth })
}

export const getSheetTabs = async (sheetId: string): Promise<string[]> => {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  return (
    res.data.sheets
      ?.map(s => s.properties?.title)
      .filter((t): t is string => Boolean(t)) ?? []
  )
}

export const getSheetData = async (sheetId: string, tab: string): Promise<string[][]> => {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: tab,
  })
  return (res.data.values as string[][]) ?? []
}

export const appendRow = async (sheetId: string, tab: string, values: string[]): Promise<void> => {
  const sheets = await getSheetsClient()
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: tab,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}

export const updateRow = async (sheetId: string, range: string, values: string[]): Promise<void> => {
  const sheets = await getSheetsClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}

export const deleteRow = async (sheetId: string, sheetGid: number, rowIndex: number): Promise<void> => {
  const sheets = await getSheetsClient()
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetGid,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  })
}
