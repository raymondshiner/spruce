import { errorResponse } from '../http';
import type { Env } from '../env';

export async function handleVisualize(_req: Request, _env: Env): Promise<Response> {
  return errorResponse(501, 'not_implemented', {
    message: 'Visualize ships in Cycle 2.',
  });
}
