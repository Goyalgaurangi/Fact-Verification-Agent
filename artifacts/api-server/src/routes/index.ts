import { Router, type IRouter } from "express";
import healthRouter from "./health";
import investigateRouter from "./investigate/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(investigateRouter);

export default router;
