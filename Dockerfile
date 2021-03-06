###############################################################################
# Step 1 : Builder image
FROM kubevious/react-builder:12 as build
WORKDIR /app
ENV NODE_ENV production
ENV PATH /app/node_modules/.bin:$PATH
COPY src/package.json ./
COPY src/package-lock.json ./
RUN npm ci --only=production
COPY src/ ./
RUN npm run build
# RUN node --expose-gc --max-old-space-size=700 node_modules/react-scripts/scripts/build.js

###############################################################################
# Step 2 : Runner image
FROM kubevious/nginx:1.8
COPY nginx/default.conf /etc/nginx/conf.d/
COPY --from=build /app/build /usr/share/nginx/html
