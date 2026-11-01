// Always set a timeout on outbound requests. Without one, a hung upstream API hangs
// the whole tool call. One shared factory keeps that rule in a single place.
import axios from "axios";

/** axios instance with a base URL and a request timeout (10s unless overridden). */
export const createClient = (baseURL?: string, timeout = 10_000) => axios.create({ baseURL, timeout });
