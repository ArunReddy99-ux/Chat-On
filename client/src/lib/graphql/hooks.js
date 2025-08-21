import { useMutation, useQuery, useSubscription } from "@apollo/client";
import {
  addMessageMutation,
  messageAddedSubscription,
  messagesQuery,
} from "./queries";

/**
 * Custom hook: useAddMessage
 * --------------------------------
 * Purpose: Provides a function `addMessage(text)` to send a new message.
 * It runs a GraphQL mutation and updates the Apollo cache
 * so the UI reflects the new message instantly.
 */
export function useAddMessage() {
  // Create a mutation function from Apollo Client
  // `mutate` will execute our GraphQL addMessageMutation
  const [mutate] = useMutation(addMessageMutation);

  // Function that actually adds a message
  const addMessage = async (text) => {
    const {
      data: { message }, // Destructure the returned "message" object from server
    } = await mutate({
      variables: { text }, // Pass the "text" variable to GraphQL mutation
    });

    return message; // Return the created message to the caller
  };

  return { addMessage }; // Hook returns an object with addMessage function
}

/**
 * Custom hook: useMessages
 * --------------------------------
 * Purpose: Fetches the list of messages from the server
 * and returns them for use inside components.
 */
export function useMessages() {
  // Run the GraphQL query to fetch messages
  //useQuery → used to fetch data from the server with a GraphQL query.
  const { data } = useQuery(messagesQuery);
  useSubscription(messageAddedSubscription, {
    onData: ({ client, data }) => {
      const newMessage = data.data.message;
      client.cache.updateQuery({ query: messagesQuery }, (oldData) => {
        return {
          // Append the new message to existing list
          messages: [...oldData.messages, newMessage],
        };
      });
    },
  });

  return {
    // Return messages if data exists, otherwise return empty array
    messages: data?.messages ?? [],
  };
}
