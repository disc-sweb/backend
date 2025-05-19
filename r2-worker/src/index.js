/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env) {
      try {
        const url = new URL(request.url);
        console.log("Request URL:", url);
        const key = url.pathname.slice(1);
   
        switch (request.method) {
          case "PUT":
            console.log("Handling PUT request");
            // Parse the request body to extract fields
            const formData = await request.formData();
            const Filename = formData.get("Filename");
            const type = formData.get("type");
            const image = formData.get("file");

            await env.MY_BUCKET.put(key, image); 
            console.log(`Uploaded ${Filename} successfully! Type: ${type}`);
            return new Response(`Uploaded ${Filename} successfully! Type: ${type}`);
          case "GET":
            console.log("Handling GET request");
            const object = await env.MY_BUCKET.get(key);
            if (object === null) {
              console.log("Object not found");
              return new Response("Object Not Found", { status: 404 });
            }
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set("etag", object.httpEtag);
            return new Response(object.body, {
              headers
            });
          case "DELETE":
            console.log("Handling DELETE request");
            await env.MY_BUCKET.delete(key);
            return new Response("Deleted!");
          default:
            console.log("Invalid request method");
            return new Response("Method Not Allowed", {
              status: 405,
              headers: {
                Allow: "PUT, GET, DELETE"
              }
            });
        }
      } catch (error) {
        console.error("Error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
};