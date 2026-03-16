import { NextResponse } from "next/server";
import { AppError } from "./app-error";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function withErrorHandler(handler: Function) {
  // TODO: deal with unknown type
  return async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("API Error:", error);

      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode },
        );
      }

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}
