export interface UserDTO {
    email: string;
    name: string;
    password: string;
}

export  class UserDtoDefault implements UserDTO {
    email: string;
    name: string;
    password: string;
    constructor(){
        this.email = ""
        this.name = ""
        this.password = ""
    }
}