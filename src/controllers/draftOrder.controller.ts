import { Request, Response } from "express";
import * as draftOrderService from "../services/draftOrder.service";
import type { DraftActor } from "../services/draftOrder.service";
import { sanitizeError } from "../utils/errors";

const actorOf = (req: Request): DraftActor => ({ id: (req as any).userId, role: (req as any).userRole });
const str = (value: unknown) => (typeof value === "string" ? value : undefined);
const id = (req: Request) => String(req.params.id);

function handler(
  operation: string,
  run: (req: Request) => Promise<unknown>,
  failureStatus = 400,
) {
  return async (req: Request, res: Response) => {
    try {
      const data = await run(req);
      res.json({ success: true, data });
    } catch (err) {
      const notFound = err instanceof Error && err.message === "Draft order not found";
      res.status(notFound ? 404 : failureStatus).json({ success: false, message: sanitizeError(err, operation) });
    }
  };
}

export const lookupCustomers = handler("lookupDraftCustomers", (req) =>
  draftOrderService.lookupCustomers(str(req.query.search)),
);

export const lookupProducts = handler("lookupDraftProducts", (req) =>
  draftOrderService.lookupProducts(str(req.query.search)),
);

export const quote = handler("quoteDraftOrder", (req) => draftOrderService.quoteDraftInput(req.body ?? {}));

export const list = handler(
  "listDraftOrders",
  (req) =>
    draftOrderService.listDraftOrders(actorOf(req), {
      page: Number(req.query.page) || undefined,
      limit: Number(req.query.limit) || undefined,
      status: str(req.query.status),
      search: str(req.query.search),
    }),
  500,
);

export const get = handler("getDraftOrder", (req) => draftOrderService.getDraftOrder(actorOf(req), id(req)));

export const create = handler("createDraftOrder", (req) =>
  draftOrderService.createDraftOrder(actorOf(req), req.body ?? {}),
);

export const update = handler("updateDraftOrder", (req) =>
  draftOrderService.updateDraftOrder(actorOf(req), id(req), req.body ?? {}),
);

export const send = handler("sendDraftOrder", (req) => draftOrderService.sendDraftOrder(actorOf(req), id(req)));

export const resend = handler("resendDraftOrder", (req) => draftOrderService.resendDraftOrder(actorOf(req), id(req)));

export const cancel = handler("cancelDraftOrder", (req) => draftOrderService.cancelDraftOrder(actorOf(req), id(req)));
