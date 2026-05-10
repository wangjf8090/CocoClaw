FROM nginx:alpine

RUN apk add --no-cache curl

COPY packages/ui/dist/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
