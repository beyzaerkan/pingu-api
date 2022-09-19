const USER_TYPES = {
  OWNER: 'owner',
  MODERATOR: 'moderator',
  GUEST: 'guest',
};

const ACTIONS = {
  UPDATE_PLAYLIST: [USER_TYPES.OWNER, USER_TYPES.MODERATOR, USER_TYPES.GUEST],
  KICK_USER: [USER_TYPES.OWNER],
  UPDATE_VIDEO_STATUS: [USER_TYPES.OWNER, USER_TYPES.MODERATOR],
  CHANGE_VIDEO_DURATION: [USER_TYPES.OWNER, USER_TYPES.MODERATOR],
  SKIP_VIDEO: [USER_TYPES.OWNER, USER_TYPES.MODERATOR],
};

export {
  USER_TYPES,
  ACTIONS,
};
