{{/*
Expand the name of the chart.
*/}}
{{- define "vision-ai-labeler.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "vision-ai-labeler.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "vision-ai-labeler.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "vision-ai-labeler.labels" -}}
helm.sh/chart: {{ include "vision-ai-labeler.chart" . }}
{{ include "vision-ai-labeler.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "vision-ai-labeler.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vision-ai-labeler.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "vision-ai-labeler.backend.labels" -}}
{{ include "vision-ai-labeler.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "vision-ai-labeler.backend.selectorLabels" -}}
{{ include "vision-ai-labeler.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "vision-ai-labeler.frontend.labels" -}}
{{ include "vision-ai-labeler.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "vision-ai-labeler.frontend.selectorLabels" -}}
{{ include "vision-ai-labeler.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "vision-ai-labeler.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "vision-ai-labeler.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Secret name
*/}}
{{- define "vision-ai-labeler.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- include "vision-ai-labeler.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/*
ConfigMap name
*/}}
{{- define "vision-ai-labeler.configMapName" -}}
{{- include "vision-ai-labeler.fullname" . }}-config
{{- end }}

{{/*
Image name with registry
*/}}
{{- define "vision-ai-labeler.image" -}}
{{- $registry := .global.imageRegistry -}}
{{- $repository := .image.repository -}}
{{- $tag := .image.tag | default "latest" -}}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}
