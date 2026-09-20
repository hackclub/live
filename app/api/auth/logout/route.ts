import { NextResponse } from "next/server";
import { getRequestOrigin } from "../../../../src/lib/origin";
import { sessionCookieOptions } from "../../../../src/lib/session";

export const revalidate = 0;

export async function POST(request: Request) {
  const response = NextResponse.redirect(`${getRequestOrigin(request)}/`, 303);
  response.cookies.delete(sessionCookieOptions.name);
  return response;
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
