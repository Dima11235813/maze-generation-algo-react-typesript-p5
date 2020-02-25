import { APP_API_URL } from "../shared/config";
import { ApiResponseSuccess } from "./models/ApiResponse";
// import { store } from '../stores'
import { logToConsole } from "../shared/logger";

// export const callDataApi = <T>(endpoint: string, init?: RequestInit) => {
//   return customFetch<T>(`${DATA_API_URL}${endpoint}`, init);
// }
export const callAppApi = <T>(endpoint: string, init?: RequestInit) => {
  return customFetch<T>(`${APP_API_URL}${endpoint}`, init);
}

export const customFetch = <T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> => {
  let newInit: RequestInit = {}
  return (
    fetch(input, newInit)
      .then((response: Response) => {
        return response.json();
      })
      .then((response: ApiResponseSuccess<T>) => {
        if (response.status !== "success") {
          console.log("Throwing Error")
          throw new Error(response.message);
        } else {
          logToConsole(`
            Netowrk Call To: ${input}
            Returned Response ${JSON.stringify(response)} 
          `)
          return response.data;
        }
      })
      .catch((error: any) => {
        return Promise.reject();
      })
  );
};
