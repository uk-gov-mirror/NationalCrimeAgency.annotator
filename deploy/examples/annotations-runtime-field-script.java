String annotationFieldName = 'metadata.annotations';
String[] annotationProps = new String[] {'feature_category', 'feature_name'};

if (params._source[annotationFieldName] != null) {
    StringBuilder builder = new StringBuilder();
    builder.append('[');

    for (annotation in params._source[annotationFieldName]) {
        builder.append('{');

        for (fieldName in annotationProps) {
            if (annotation[fieldName] != null) {
                builder.append('"').append(fieldName).append('": "').append(annotation[fieldName]).append('", ');
            }
        }

        builder.setLength(builder.length() - 2);
        builder.append('},');
    }

    if (builder.length() > 1) {
      builder.setLength(builder.length() - 1);
    }

    builder.append(']');
    emit(builder.toString());
}
