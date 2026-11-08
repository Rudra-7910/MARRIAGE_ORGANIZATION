import { api } from "./api";

export type Place = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export async function searchPlaces(search: string) {
  const response = await api.get<{ data: Place[] }>("/integrations/places", {
    params: { search },
  });
  return response.data.data;
}
