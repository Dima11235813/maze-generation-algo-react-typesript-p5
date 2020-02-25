import React from "react";
import LoginForm from "./LoginForm";
import { RouteComponentProps } from "react-router-dom";

//Apollo
import { Mutation } from "react-apollo";
import { gql } from "apollo-boost";
import { userFragment } from "../../graphql/fragments/userFragment";
import { meQuery } from "../../graphql/queries/me";
import { LoginMutation, LoginMutationVariables } from "../../schemaTypes";
import { inject, observer } from "mobx-react";
import { RouterStore } from "mobx-react-router";
import { APP_ROUTES } from "../../utils/routeUtils";

const loginMutation = gql`
  mutation LoginMutation($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      ...UserInfo
    }
  }

  ${userFragment}
`;

interface LoginViewProps {
  routerStore?: RouterStore;
}
export class LoginView extends React.PureComponent<
  RouteComponentProps<{}> & LoginViewProps
> {
  render() {
    return (
      <Mutation<LoginMutation, LoginMutationVariables>
        update={(cache, { data }) => {
          debugger
          if (!data || !data.login) {
            return;
          }

          cache.writeQuery({
            query: meQuery,
            data: { me: data.login }
          });
        }}
        mutation={loginMutation}
      >
        {(mutate, { client }) => (
          <LoginForm
            onSubmit={async (data: any) => {
              debugger;
              // optional reset cache
              await client!.resetStore();
              const response = await mutate({
                variables: data
              });
              console.log(response);
              this.props.routerStore!.history.push(`/${APP_ROUTES.ACCOUNT}`);
            }}
          />
        )}
      </Mutation>
    );
  }
}

export default inject("routerStore")(observer(LoginView));
