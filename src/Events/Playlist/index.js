import { SOCKET_EVENTS, PLAYLIST_STATUS } from '../../Constants';
import RoomService from '../../Services/Room';

export const updatePlaylist = async (
  { id, videoId, username, link, status }, { socket, io }
) => {
  switch (status) {
    case PLAYLIST_STATUS.ADD:
      await RoomService.addVideoToPLaylist({ id, username, link });
      break;
    case PLAYLIST_STATUS.MOVE_DOWN:
      await RoomService.moveDown(id, videoId);
      break;
    case PLAYLIST_STATUS.MOVE_UP:
      await RoomService.moveUp(id, videoId);
      break;
    default:
      break;
  }
  
  io.to(id).emit(SOCKET_EVENTS.PLAYLIST_UPDATED, { id, username, link, status });
};

export default [
  {
    event: SOCKET_EVENTS.UPDATE_PLAYLIST,
    handler: updatePlaylist,
  },
];
