import { z } from "zod";
import { WebsocketHandler } from "../utils/type";
import { ERR_INVALID_GAME, ERR_INVALID_USER, UserController } from "database";
import { getAPIG } from "../APIGateway";

export const hitHandler: WebsocketHandler = async (event, context) => {
  const { send } = getAPIG(event, context);

  const [user] = await UserController.getUserMeta({
    connectionId: context.connectionId,
  });

  if (!user) {
    return await send({
      status: "REQUEST_ERROR",
      error: ERR_INVALID_USER,
    });
  } else if (!user.game) {
    return await send({
      status: "REQUEST_ERROR",
      error: ERR_INVALID_GAME,
    });
  }

  return await send({
    status: "OK",
    content: user,
    error: null,
  });

  // Draw
};
