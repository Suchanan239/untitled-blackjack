import serverless, { Application } from "serverless-http";
import app from "./src/app";

export const handler = serverless(app() as Application);
