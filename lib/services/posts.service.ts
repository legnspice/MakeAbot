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

export async function createPost(data: {
  user_id: string;
  title: string;
  price?: number;
  description?: string;
  status?: PostStatus;
}) {
  try {
    return await postsRepo.insertPost(data);
  } catch (error) {
    console.error("Failed to create post with db: ", error);
    throw error;
  }
}

export async function createPostBid(data: {
  post_id: string;
  bidder_id: string;
}) {
  try {
    return await postsRepo.insertPostBid(data);
  } catch (error) {
    console.error("Failed to create a post bid from db: ", error);
    throw error;
  }
}

export async function removePost(id: string) {
  try {
    return await postsRepo.deletePost(id);
  } catch (error) {
    console.error("Failed to delete post from db: ", error);
    throw error;
  }
}

export async function removePostBid(id: string) {
  try {
    return await postsRepo.deletePostBid(id);
  } catch (error) {
    console.error("Failed to delete post bid from db: ", error);
    throw error;
  }
}

export async function editPost(
  id: string,
  data: {
    price?: number;
    title?: string;
    description?: string;
    status?: PostStatus;
    completed_at?: Date;
  },
) {
  try {
    return await postsRepo.updatePost(id, data);
  } catch (error) {
    console.error("Failed to update post from db: ", error);
    throw error;
  }
}
