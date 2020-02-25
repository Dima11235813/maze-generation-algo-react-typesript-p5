import { callAppApi } from './CustomFetch';
import { UserDTO } from './models/UserDTO';

export class UserApi {

  public static getCurrentUser = (): Promise<UserDTO> => {
    return callAppApi(`/`);
  }

}