#!/bin/sh

sudo service ssh restart

touch ~/.hushlogin 

while true; do sleep 1; done # use this for aws ecs