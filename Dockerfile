FROM docker.elastic.co/kibana/kibana:8.17.1
COPY build/annotator-8.17.1.zip /usr/share/kibana/installplugins/annotator/build/
RUN /usr/share/kibana/bin/kibana-plugin install file:///usr/share/kibana/installplugins/annotator/build/annotator-8.17.1.zip
RUN /usr/share/kibana/bin/kibana --optimize
