export function GET() {
  return Response.json({
    status: 'ok',
    service: 'github-architecture-explorer',
    timestamp: new Date().toISOString(),
  });
}
