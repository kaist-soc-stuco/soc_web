process.env.NODE_ENV ||= "development";

void import("./main").then(({ bootstrap }) => bootstrap());
