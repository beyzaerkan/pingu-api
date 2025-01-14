import mongoose from "mongoose";
import generateId from "../Utilities/GenerateId";

const Room = new mongoose.Schema({
  id: { 
    type: String, 
    default: generateId(),
  },
  playlist: {
    type: Array,
    default: [],
  },
  name: String,
  users: {
    type: Array,
    default: [],
  }
});

const RoomModel = mongoose.model("Room", Room);

export default RoomModel;
