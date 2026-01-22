import * as postsRepo from "../repo/posts.repo";
import { PostStatus } from "../db/schema";

export async function getPosts(filters: {
  id?: string;
  user_id?: string;
  price?: number;
  title?: string;
  created_at?: Date;
  status?: PostStatus;
}) {
  try {
    return await postsRepo.findPosts(filters);
  } catch (error) {
    console.error("Failed to get posts from db: ", error);
    throw error;
  }
}

export async function getPostBids(filters: {
  id?: string;
  post_id?: string;
  bidder_id?: string;
  created_at?: Date;
}) {
  try {
    return await postsRepo.findPostBids(filters);
  } catch (error) {
    console.error("Failed to get posts bids from db: ", error);
    throw error;
  }
}
