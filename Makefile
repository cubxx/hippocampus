.PHONY: dev

DIRPATH:=$(dir $(abspath $(lastword $(MAKEFILE_LIST))))
NAME:=$(notdir $(DIRPATH:/=))-dev

dev:
	@if ! tmux has-session -t ${NAME} 2>/dev/null; then \
		tmux new-session -d -s ${NAME}; \
		tmux send-keys -t ${NAME}:0.0 "bun dev:client" C-m; \
		tmux split-window -h -t ${NAME}:0; \
		tmux send-keys -t ${NAME}:0.1 "bun start:server" C-m; \
	fi
	@tmux attach-session -t ${NAME}

