import { AppError } from "./app-error";

export async function handleAction<T>(action: () => Promise<T>) {
  try {
    const data = await action();
    return { data, error: null };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      data: null,
      error: error instanceof AppError ? error.message : "Something went wrong",
    };
  }
}
