import axios from 'axios';
import MessageService from '../Message';
import generateId from '../../Utilities/GenerateId';
import { USER_TYPES, VIDEO_STATUS, RENAMES } from '../../Constants';
import { MongoRoomModel, RedisRoomModel, UserModel } from '../../Models';
import CustomError from '../../Exceptions/CustomError';

const createRoom = async ({
  id, username, roomName, videoUrl,
}) => {
  if (!id) {
    id = generateId();
  }

  const data = {
    id,
    video: {
      link: videoUrl,
      duration: 0,
      status: VIDEO_STATUS.STOPPED,
    },
    messages: [
      MessageService.createSystemMessage(`Room created by ${username}`),
    ],
  };

  const user = await UserModel.create({
    id: generateId(),
    socketId: '',
    username,
    role: USER_TYPES.OWNER,
  });

  const redisRoom = (await RedisRoomModel.create(data)).getPureData();

  const mongoRoom = await MongoRoomModel.create({
    id,
    name: roomName,
    users: [user.id],
  });

  const room = {
    ...redisRoom,
    ...mongoRoom._doc,
    users: [user],
  };

  return room;
};

const joinRoom = async ({
  id, username,
}) => {
  const redisRoom = await RedisRoomModel.findById(id);

  if (!redisRoom) {
    throw new CustomError('Room not find or you dont have a permission!', 403);
  }

  let mongoRoom = await MongoRoomModel.findOne({ id });

  const user = await UserModel.create({
    id: generateId(),
    username,
    role: USER_TYPES.GUEST,
  });
  mongoRoom.users.push(user.id);

  await mongoRoom.save();
  mongoRoom = await MongoRoomModel.aggregate([{
    $match: {
      id,
    },
  }, {
    $lookup: {
      from: 'users',
      localField: 'users',
      foreignField: 'id',
      as: 'users',
    },
  }]);
  mongoRoom = mongoRoom[0];

  const room = {
    ...redisRoom,
    ...mongoRoom,
  };

  return room;
};

const findRooms = async (id) => {
  const redisRoom = await RedisRoomModel.findById(id);
  const mongoRoom = await MongoRoomModel.findOne({ id });

  if (!redisRoom || !mongoRoom) {
    throw new CustomError('Room not find or you dont have a permission!', 403);
  }

  const room = {
    ...redisRoom,
    ...mongoRoom._doc,
  };

  return room;
};

const findMongoRoom = async (id) => {
  const mongoRoom = await MongoRoomModel.findOne({ id });

  if (!mongoRoom) {
    throw new CustomError('Room not find or you dont have a permission!', 403);
  }

  return mongoRoom;
};

const findRedisRoom = async (id) => {
  const redisRoom = await RedisRoomModel.findById(id);

  if (!redisRoom) {
    throw new CustomError('Room not find or you dont have a permission!', 403);
  }

  return redisRoom;
};

const isExist = async (id) => {
  if (!id) {
    throw new CustomError('id is required!', 400);
  }
  const redisKey = `${RedisRoomModel.keyPrefix}:${id}`;
  const keyCount = (await RedisRoomModel.redisClient.keys(redisKey)).length;
  return keyCount > 0;
};

const YOUTUBE_PLAYLIST_ITEMS_API = 'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&';

const addVideoToPLaylist = async ({ id, username, link }) => {
  const mongoRoom = await findMongoRoom(id);

  const word = 'playlist';
  const isPlaylist = link.includes(word);

  if (isPlaylist) {
    const playlistId = link.split('list=')[1];
    const response = await axios.get(`${YOUTUBE_PLAYLIST_ITEMS_API}playlistId=${playlistId}&maxResults=500&key=${process.env.YOUTUBE_API_KEY}`);

    const playlist = response.data.items;
    mongoRoom.playlist = mongoRoom.playlist.concat(
      playlist.map((video) => ({
        id: generateId(),
        username,
        link: `https://www.youtube.com/watch?v=${video.contentDetails.videoId}`,
      })),
    );
  } else {
    mongoRoom.playlist.push({
      id: generateId(),
      username,
      link,
    });
  }

  await mongoRoom.save();

  return mongoRoom.playlist;
};

const moveDownVideo = async (roomId, videoId) => {
  const mongoRoom = await findMongoRoom(roomId);

  const index = mongoRoom.playlist.findIndex((video) => video.id === videoId);

  if (mongoRoom.playlist.length === index) {
    return;
  }

  const element = mongoRoom.playlist.splice(index, 1)[0];
  mongoRoom.playlist.splice(index + 1, 0, element);

  await mongoRoom.save();

  return mongoRoom.playlist;
};

const moveUpVideo = async (roomId, videoId) => {
  const mongoRoom = await findMongoRoom(roomId);

  const index = mongoRoom.playlist.findIndex((video) => video.id === videoId);

  if (index === 0) {
    return;
  }

  const element = mongoRoom.playlist.splice(index, 1)[0];

  mongoRoom.playlist.splice(index - 1, 0, element);
  await mongoRoom.save();

  return mongoRoom.playlist;
};

const removeVideoFromPlaylist = async (roomId, videoId) => {
  const mongoRoom = await findMongoRoom(roomId);

  const index = mongoRoom.playlist.findIndex((video) => video.id === videoId);

  mongoRoom.playlist.splice(index, 1);
  await mongoRoom.save();

  return mongoRoom.playlist;
};

const kickUserFromRoom = async (roomId, userId) => {
  const mongoRoom = await MongoRoomModel.findOne({ roomId });

  const index = mongoRoom.users.findIndex((id) => id === userId);

  mongoRoom.users.splice(index, 1);

  await UserModel.findOneAndDelete({ userId });
  await mongoRoom.save();
};

const playVideo = async (roomId) => {
  const redisRoom = await findRedisRoom(roomId);

  redisRoom.video.status = VIDEO_STATUS.PLAYED;
  await redisRoom.save();
  return redisRoom.video;
};

const stopVideo = async (roomId) => {
  const redisRoom = await findRedisRoom(roomId);

  redisRoom.video.status = VIDEO_STATUS.STOPPED;
  await redisRoom.save();
  return redisRoom.video;
};

const jumpInVideo = async (roomId, duration) => {
  const redisRoom = await findRedisRoom(roomId);

  redisRoom.video.duration = duration;
  await redisRoom.save();
  return redisRoom.video;
};

const skipVideo = async (roomId) => {
  const redisRoom = await findRedisRoom(roomId);
  const mongoRoom = await findMongoRoom(roomId);

  if (mongoRoom.playlist.length === 0) {
    return;
  }

  redisRoom.video.duration = 0;
  redisRoom.video.status = VIDEO_STATUS.STOPPED;
  redisRoom.video.link = mongoRoom.playlist.shift().link;

  await redisRoom.save();
  await mongoRoom.save();

  const room = {
    ...redisRoom,
    ...mongoRoom._doc,
  };

  return room;
};

const getVideoDuration = async (roomId) => {
  const redisRoom = await findRedisRoom(roomId);

  return redisRoom.video.duration;
};

const findUserWithId = async (id) => {
  const user = await UserModel.findOne({ id });

  if (!user) {
    throw new CustomError('User not find or you dont have a permission!', 403);
  }

  return user;
};

const findUserWithSocketId = async (socketId) => {
  const user = await UserModel.findOne({ socketId });

  if (!user) {
    throw new CustomError('User not find or you dont have a permission!', 403);
  }

  return user;
};

const addSocketId = async (id, socketId) => {
  const user = await findUserWithId(id);
  user.socketId = socketId;

  user.save();
  return user;
};

const changeName = async ({id, socketId,  type, name}) => {
  let willBeRenamed;
  switch (type) {
    case RENAMES.USER:
      willBeRenamed = await findUserWithSocketId(socketId);
      willBeRenamed.username = name;
      break;
    case RENAMES.ROOM:
      willBeRenamed = await findMongoRoom(id);
      willBeRenamed.name = name;
      break;
    default:
      break;
  }

  willBeRenamed.save();

  return willBeRenamed;
};

const RoomService = {
  createRoom,
  joinRoom,
  findRooms,
  findMongoRoom,
  findRedisRoom,
  isExist,
  addVideoToPLaylist,
  moveDownVideo,
  moveUpVideo,
  removeVideoFromPlaylist,
  kickUserFromRoom,
  playVideo,
  stopVideo,
  jumpInVideo,
  skipVideo,
  getVideoDuration,
  findUserWithId,
  findUserWithSocketId,
  addSocketId,
  changeName,
};

export default RoomService;
