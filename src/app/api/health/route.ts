export function GET() {
  return Response.json({
    status: 'ok',
    service: 'reposcope',
    timestamp: new Date().toISOString(),
  });
}
