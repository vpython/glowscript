FROM python:3.8.5-buster

RUN mkdir /app

WORKDIR /app

COPY ./requirements.txt /app

RUN pip install -U pip

RUN pip install -r requirements.txt

COPY . /app

CMD flask run



