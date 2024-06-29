from flask import Flask, render_template, request, redirect, url_for
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

def check_website(url):
    return True

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/check')
def checker():
    return render_template('check.html')

@app.route('/check/result')
def result():

    url = request.args.get('url')
        
    page_to_scrape = requests.get('https://www.urlvoid.com/scan/'+url+'/')
    soup = BeautifulSoup(page_to_scrape.text, 'html.parser')

    userInputs = soup.findAll("div", attrs={"class":"table-responsive"})
    
    for userInput in userInputs:
        print(userInput)
    
    return render_template('check_result.html')


@app.route('/test')
def test():

    page_to_scrape = requests.get('https://quotes.toscrape.com/')
    soup = BeautifulSoup(page_to_scrape.text, 'html.parser')

    quotes = soup.findAll("span", attrs={"class":"text"})
    authors = soup.findAll("small", attrs={"class":"author"})

    quotes_with_authors = []
    for quote, author in zip (quotes, authors):
        quotes_with_authors.append(quote.text + " - " + author.text)
    print(quotes_with_authors)
    return render_template("test.html", quotes_with_authors=quotes_with_authors)

if __name__ == "__main__":
    app.run(debug=True)

