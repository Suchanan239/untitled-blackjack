import { FilterQuery, UpdateQuery } from "mongoose";
import { IUser, User, ZodUserStrip, _IUser } from "../models/UserModel";
import { asyncTransaction } from "../utils/Transaction";
import { Card } from "../utils/Card";
import { ERR_INVALID_USER } from "../utils/Error";

const getAllConnections = asyncTransaction(async () => {
  const _ = (await User.find().select(["connectionId"])) as unknown as _IUser[];
  return _.map((user) => user.connectionId);
});

const clearStaleConnection = asyncTransaction(
  async (connectionIds: string[]) => {
    const _ = await User.deleteMany({ connectionId: { $in: connectionIds } });
    return _;
  }
);

const createUser = asyncTransaction(async (args: FilterQuery<IUser>) => {
  const _ = new User(args);
  const res = await _.save();

  return res;
});

/**
 * @description Update a user instance
 * TRY NOT TO USE THIS FOR SECURITY REASONS
 */
const updateUser = asyncTransaction(
  async (target: FilterQuery<IUser>, value: UpdateQuery<IUser>) => {
    const _ = await User.findOneAndUpdate(target, value);
    if (!_?.id) {
      return new Error("User not found");
    }
    return ZodUserStrip.parse(_);
  }
);

/**
 * @description Delete a user instance
 */
const deleteUser = asyncTransaction(async (args: FilterQuery<IUser>) => {
  const _ = await User.deleteOne(args);
  return _;
});

/**
 * @descrition Get basic non-sensitive user information
 * @param args
 */
const getUserMeta = asyncTransaction(async (args: FilterQuery<IUser>) => {
  const _ = await User.findOne(args).select({
    cards: 0,
    connectionId: 0,
  });
  if (!_) throw ERR_INVALID_USER;
  return ZodUserStrip.parse(_);
});

/**
 * @description Get user session id (sensitive information)
 * @param args
 * @returns
 */
const getConnectionId = asyncTransaction(async (args: FilterQuery<IUser>) => {
  const _ = (await User.findOne(args).select([
    "connectionId",
  ])) as unknown as _IUser;
  if (!_?.connectionId) throw ERR_INVALID_USER;
  return _.connectionId;
});

const getCards = asyncTransaction(
  async (args: FilterQuery<IUser>, all: boolean = false) => {
    const _ = (await User.findOne(args).select("cards")) as unknown as _IUser;
    if (all) return _?.cards! ?? [];
    return _?.cards!.slice(1) ?? [];
  }
);

const setCards = asyncTransaction(
  async (connectionId: string, cards: Card[]) => {
    const [userMeta] = await getUserMeta({ connectionId });
    if (!userMeta) throw ERR_INVALID_USER;

    const _ = await User.findOneAndUpdate(
      {
        _id: userMeta.id,
      },
      {
        cards,
      }
    );

    const [updated, err] = await getUserMeta({ connectionId });
    if (err) throw err;

    if (!updated) throw ERR_INVALID_USER;
    return ZodUserStrip.parse(updated);
  }
);

const addCards = asyncTransaction(
  async (connectionId: string, cards: Card[]) => {
    const [oldCards, err] = await getCards({ connectionId });
    if (err) {
      throw ERR_INVALID_USER;
    }

    await User.findOneAndUpdate(
      {
        connectionId,
      },
      {
        $push: {
          cards: {
            $each: cards,
          },
        },
      }
    );

    return [...cards, ...oldCards];
  }
);

const setReadyState = asyncTransaction(
  async (connectionId: string, ready: boolean) => {
    const [userMeta, err] = await getUserMeta({ connectionId });
    if (err) {
      throw ERR_INVALID_USER;
    }
    if (!userMeta) {
      throw ERR_INVALID_USER;
    }

    const _ = await User.findOneAndUpdate(
      {
        _id: userMeta.id,
      },
      {
        $set: {
          ready,
        },
      }
    );

    if (!_) throw ERR_INVALID_USER;

    return ZodUserStrip.parse(_);
  }
);

const setStandState = asyncTransaction(
  async (target: FilterQuery<IUser>, stand: boolean) => {
    // check if the user exists
    const [userMeta, err] = await getUserMeta(target);
    if (err) throw err;

    // update the user
    const _ = await User.findOneAndUpdate(target, {
      stand,
    });

    const [updated, err2] = await getUserMeta(target);
    if (err2) throw err2;

    return ZodUserStrip.parse(updated);
  }
);

const getCardsSums = asyncTransaction(async (target: FilterQuery<IUser>) => {
  const [cards, err] = await getCards(target, true);
  if (err) throw err;

  const firstSum = cards.reduce((acc, card) => {
    if (card.display === "A") return acc + 1;
    if (card.display === "J" || card.display === "Q" || card.display === "K")
      return acc + 10;
    return acc + Number(card.values[0]);
  }, 0);

  const secondSum = cards.reduce((acc, card) => {
    if (card.display === "A") return acc + 11;
    if (card.display === "J" || card.display === "Q" || card.display === "K")
      return acc + 10;
    return acc + Number(card.values[0]);
  }, 0);

  return [firstSum, secondSum];
});

export const UserController = {
  /**
   * @description Get all users' connections
   */
  getAllConnections,
  /**
   * @description Clear stale connection
   */
  clearStaleConnection,
  /**
   * @access Public
   *
   * @description Create a new user
   */
  createUser,
  /**
   * @access System level
   */
  updateUser,
  /**
   * @access System level
   */
  deleteUser,
  /**
   * @access System Level, User themselves, Authorized users
   */
  getUserMeta,
  /**
   * @access System level
   */
  getConnectionId,
  /**
   * @access System level, User themselves
   *
   * @description Get all of the target user cards (the first one should be hidden from opponenet)
   */
  getCards,
  /**
   * @access System level
   */
  setCards,
  /**
   * @access System level
   *
   * @description Add cards to the user, returns ALL the cards
   */
  addCards,
  /**
   * @access User themselves
   *
   * @description Set the player ready state
   */
  setReadyState,
  /**
   * @access System Level
   *
   * @description Set the player stand state
   */
  setStandState,
  /**
   * @access System Level
   *
   * @description Get the sum of the cards
   */
  getCardsSums,
};
