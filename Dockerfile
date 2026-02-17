FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

COPY index.html ./
COPY app.js ./
COPY styles.css ./
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
