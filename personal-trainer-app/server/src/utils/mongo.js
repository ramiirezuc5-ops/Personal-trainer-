import mongoose from 'mongoose';

export const oid = (id) => new mongoose.Types.ObjectId(String(id));
export const isDup = (err) => err?.code === 11000;
