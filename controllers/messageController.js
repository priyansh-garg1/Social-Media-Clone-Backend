import Conversation from "../models/conversationsModel.js";
import Message from "../models/messageModel.js";
import { getRecipientSocketId, io } from "../socket/socket.js";
import { v2 as cloudinary } from "cloudinary";


const getMessage = async (req, res) => {
  const { otherUserId } = req.params;
  const userId = req.user._id;
  try {
    const conversation = await Conversation.findOne({
      participants: { $all: [userId, otherUserId] },
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const messages = await Message.find({
      conversationId: conversation._id,
    }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getConversations = async (req, res) => {
  const userId = req.user._id;
  try {
    const conversation = await Conversation.find({
      participants: userId,
    }).populate({
      path: "participants",
      select: "profilePic username",
    });
    conversation.forEach((conversation) => {
      conversation.participants = conversation.participants.filter(
        (participant) => participant._id.toString() !== userId.toString()
      );
    });
    return res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { recipientId, message } = req.body;
    let {img} = req.body;
    const senderId = req.user._id;
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });
    if (!conversation) {
      conversation = await Conversation({
        participants: [senderId, recipientId],
        lastMessage: {
          text: message,
          sender: senderId,
        },
      });
      await conversation.save();
    }
    if(img){
      const res = await cloudinary.uploader.upload(img);
      img = res.secure_url;
    }
    const newMessage = await Message({
      text: message,
      sender: senderId,
      conversationId: conversation._id,
      img:img||""
    });
    await Promise.all([
      newMessage.save(),
      conversation.updateOne({
        lastMessage: {
          text: message,
          sender: senderId,
        },
      }),
    ]);

    const recipientSocketId = getRecipientSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteMessages = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.user._id;
    const conversation = await Conversation.findOne({
      participants: { $all: [userId, otherUserId] },
    });
    console.log(conversation);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const messages = await Message.deleteMany({
      conversationId: conversation._id,
    })
    console.log(messages);
    await Conversation.deleteOne({participants: { $all: [userId, otherUserId] }})
    res.status(200).json({ message: "Messages deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export { sendMessage, getMessage, getConversations,deleteMessages };
