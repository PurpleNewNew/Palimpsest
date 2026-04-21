import { configureRunner } from "@palimpsest/runner"
import { Log } from "./util/log"

const log = Log.create({ service: "remote-task-runner" })

configureRunner({
  logger: {
    info: (msg, data) => log.info(msg, data),
    error: (msg, data) => log.error(msg, data),
  },
})
