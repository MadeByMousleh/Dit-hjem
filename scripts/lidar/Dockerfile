FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1
RUN pip install --no-cache-dir laspy[lazrs]==2.6.1 numpy==2.2.6 scipy==1.15.3 shapely==2.1.1
ENTRYPOINT ["python", "/data/crop-parcel.py"]
